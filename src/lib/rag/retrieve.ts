import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { embedQuery } from "@/lib/ai/embeddings";
import { fuseRankings } from "@/lib/rag/fusion";
import { extractKeywords, toTsQuery } from "@/lib/rag/keywords";

export interface RetrievedChunk {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  content: string;
}

const CANDIDATES_PER_SEARCH = 20;
const MAX_RESULTS = 10;

/**
 * Finds the code pieces most relevant to a question: meaning-based search (pgvector)
 * plus keyword search (Postgres full text), combined with rank fusion.
 *
 * `repositoryId` must come from a lookup that already checked it belongs to the
 * signed-in user. Every query below is limited to that one repository.
 */
export async function retrieveChunks(input: {
  repositoryId: string;
  question: string;
  previousQuestion?: string;
}): Promise<RetrievedChunk[]> {
  const { repositoryId, question, previousQuestion } = input;

  // A short follow-up like "explain more" has no keywords, so borrow the previous question.
  const searchText = question.length < 40 && previousQuestion ? `${previousQuestion}\n${question}` : question;

  const vector = await embedQuery(searchText);
  const vectorLiteral = `[${vector.join(",")}]`;
  const tsQuery = toTsQuery(extractKeywords(searchText));

  const [byMeaning, byKeyword] = await Promise.all([
    db.$queryRaw<RetrievedChunk[]>(Prisma.sql`
      SELECT c."id", f."path", c."startLine", c."endLine", c."content"
      FROM "code_chunk" c
      JOIN "repository_file" f ON f."id" = c."repositoryFileId"
      WHERE c."repositoryId" = ${repositoryId} AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${CANDIDATES_PER_SEARCH}`),
    tsQuery
      ? db.$queryRaw<RetrievedChunk[]>(Prisma.sql`
          SELECT c."id", f."path", c."startLine", c."endLine", c."content"
          FROM "code_chunk" c
          JOIN "repository_file" f ON f."id" = c."repositoryFileId"
          WHERE c."repositoryId" = ${repositoryId}
            AND to_tsvector('simple', c."content") @@ to_tsquery('simple', ${tsQuery})
          ORDER BY ts_rank(to_tsvector('simple', c."content"), to_tsquery('simple', ${tsQuery})) DESC
          LIMIT ${CANDIDATES_PER_SEARCH}`)
      : Promise.resolve([] as RetrievedChunk[]),
  ]);

  const byId = new Map<string, RetrievedChunk>();
  for (const row of [...byMeaning, ...byKeyword]) byId.set(row.id, row);

  return fuseRankings([byMeaning.map((r) => r.id), byKeyword.map((r) => r.id)])
    .slice(0, MAX_RESULTS)
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}