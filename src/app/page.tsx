import PromptGenerator from "@/components/PromptGenerator";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 py-12 md:p-16 relative z-10">
      <PromptGenerator />
    </main>
  );
}
