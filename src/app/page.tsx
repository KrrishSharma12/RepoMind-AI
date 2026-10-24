"use client";
import { Suspense, useEffect } from "react";
import { AuthNotice } from "@/components/landing/auth-notice";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SharedEngine } from "@/components/landing/SharedEngine";
import { Benefits } from "@/components/landing/Benefits";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []); 

  return (
    <>
      <Suspense fallback={null}>
        <AuthNotice />
      </Suspense>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <SharedEngine />
        <Benefits />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}