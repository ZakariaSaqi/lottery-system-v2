import { GenerateForm } from "../components/forms/generate-form";
import React from "react";

function Home() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <GenerateForm />
      </div>
    </div>
  );
}

export default Home;
