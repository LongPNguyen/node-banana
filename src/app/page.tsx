"use client";

import { Header } from "@/components/Header";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { AnnotationModal } from "@/components/AnnotationModal";
import { SettingsModal } from "@/components/SettingsModal";
import { WorkflowSidebar } from "@/components/WorkflowSidebar";

export default function Home() {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <WorkflowSidebar />
      <WorkflowCanvas />
      <AnnotationModal />
      <SettingsModal />
    </div>
  );
}
