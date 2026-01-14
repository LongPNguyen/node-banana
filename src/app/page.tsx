"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { Header } from "@/components/Header";
import { WorkflowCanvas } from "@/components/WorkflowCanvas";
import { FloatingActionBar } from "@/components/FloatingActionBar";
import { AnnotationModal } from "@/components/AnnotationModal";
import { SettingsModal } from "@/components/SettingsModal";
import { WorkflowSidebar } from "@/components/WorkflowSidebar";

export default function Home() {
  return (
    <ReactFlowProvider>
      <div className="h-screen flex flex-col">
        <Header />
        <WorkflowSidebar />
        <WorkflowCanvas />
        <FloatingActionBar />
        <AnnotationModal />
        <SettingsModal />
      </div>
    </ReactFlowProvider>
  );
}
