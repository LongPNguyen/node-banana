# Claude Memory - NodeMango Development

Last updated: 2026-01-22

## Project Overview
NodeMango is a node-based visual workflow editor for AI content creation. Users drag nodes onto a React Flow canvas, connect them, and execute pipelines that call various AI APIs (Gemini, Kling, ElevenLabs, etc.).

## Recent Work Completed

### Remotion Integration (Video Post-Processing)
- Installed Remotion packages: `@remotion/cli`, `@remotion/renderer`, `@remotion/media-utils`, `@remotion/transitions`
- Created `src/remotion/` directory with:
  - `Root.tsx` - Remotion composition root
  - `DynamicVideo.tsx` - Dynamic video component for AI-generated code
  - `index.ts` - Entry point
  - `templates/` - Intro/outro templates (FadeIn, SlideUp, Glitch, Zoom, Particles, etc.)

### New Nodes Created

#### 1. RemotionNode (`src/components/nodes/RemotionNode.tsx`)
- Adds intro/outro sequences to videos
- Supports multiple templates (FadeIn, SlideUp, Glitch, etc.)
- Configurable duration, text, colors, logo
- API: `/api/remotion-render`

#### 2. VideoComposerNode (`src/components/nodes/VideoComposerNode.tsx`)
- Takes LLM-generated Remotion code and renders it
- Accepts video and image inputs as assets
- Configurable duration, aspect ratio, FPS
- API: `/api/video-composer`

#### 3. GreenScreenNode (`src/components/nodes/GreenScreenNode.tsx`)
- Baked-in workflow that:
  1. Extracts first frame from input video
  2. Sends to NanoBanana to generate person on green screen background
  3. Runs through Kling Motion Capture to animate
  4. Outputs video of AI replica on green screen
- API: `/api/green-screen`

### Toolbar Improvements
- Fixed viewport center calculation for click-to-add nodes (accounts for sidebar width)
- Fixed drag-and-drop from dropdown menus (Tools, Generate) by delaying menu close

### Other Completed Items
- Adjusted React Flow zoom limits (0.1 min, 4 max)
- All nodes properly registered in:
  - `types/index.ts` (types)
  - `nodes/index.ts` (exports)
  - `WorkflowCanvas.tsx` (nodeTypes, getNodeHandles, minimap colors, handle mappings)
  - `ConnectionDropMenu.tsx` (connection options)
  - `FloatingActionBar.tsx` (Tools menu)
  - `workflowStore.ts` (createDefaultNodeData, defaultDimensions)
  - `validation.ts` (VALID_NODE_TYPES, DEFAULT_DIMENSIONS, createDefaultNodeData)

## Pending Tasks

### 1. Rename RemotionNode to IntroOutroNode
- More descriptive name for what it does
- Need to update: types, component file name, all registrations

### 2. Create LLM Prompt Template for Remotion Code Generation
- Template for LLM to generate valid Remotion code
- Should include available components, asset placeholders, best practices
- For use with VideoComposerNode

### 3. Build Audio Mixer Node
- Combine multiple audio tracks
- Adjust volume levels per track
- Mix background music with voice, etc.

### 4. Enhance Caption Positioning with X/Y Controls
- Currently only has "top", "center", "bottom" presets
- Add precise X/Y coordinate controls for custom positioning

## Node Types Reference

| Node | Type | Inputs | Outputs | Purpose |
|------|------|--------|---------|---------|
| ImageInput | imageInput | reference | image | Load images |
| VideoInput | videoInput | - | video | Load videos |
| Annotation | annotation | image | image | Draw on images |
| Prompt | prompt | - | text | Text input |
| NanoBanana | nanoBanana | image, text | image | AI image generation |
| LLMGenerate | llmGenerate | text, image | text | AI text generation |
| Output | output | image, video | - | Display results |
| VideoGenerate | videoGenerate | image, text | video | AI video generation |
| ElevenLabs | elevenLabs | text | audio | Text-to-speech |
| VideoStitch | videoStitch | video | video | Combine videos |
| VideoUpscale | videoUpscale | video | video | Upscale resolution |
| AudioProcess | audioProcess | video | video | Denoise audio |
| Caption | caption | video | video | Add captions |
| VoiceSwap | voiceSwap | video | video | Replace voice |
| SoundEffects | soundEffects | text | audio | Generate SFX |
| MusicGenerate | musicGenerate | text | audio | Generate music |
| MotionCapture | motionCapture | image, video | video | Animate image with video motion |
| Remotion | remotion | video | video | Add intro/outro |
| VideoComposer | videoComposer | video, image, text | video | Render Remotion code |
| GreenScreen | greenScreen | video | video | Create green screen version |

## Key Files

| Purpose | Location |
|---------|----------|
| All types | `src/types/index.ts` |
| Workflow state & execution | `src/store/workflowStore.ts` |
| Main canvas | `src/components/WorkflowCanvas.tsx` |
| Node exports | `src/components/nodes/index.ts` |
| Connection menu | `src/components/ConnectionDropMenu.tsx` |
| Floating toolbar | `src/components/FloatingActionBar.tsx` |
| Quickstart validation | `src/lib/quickstart/validation.ts` |
| Remotion components | `src/remotion/` |

## API Keys Required
- `GEMINI_API_KEY` - For NanoBanana image generation and LLM
- `KIEAI_API_KEY` - For Kling video generation and motion capture
- `ELEVENLABS_API_KEY` - For voice synthesis and voice swap
- `OPENAI_API_KEY` - Optional, for OpenAI LLM provider
- `REPLICATE_API_KEY` - **Not currently used** - placeholder for future Replicate.com integrations

## Node Explanations
- **Annotation Node**: Draw on images using Konva.js canvas tools (shapes, arrows, text, freehand). Useful for marking areas to guide AI generation - e.g., circling what to change before sending to NanoBanana.

## Adding New Nodes Checklist
1. Define data interface in `src/types/index.ts`
2. Add to `NodeType` union in `src/types/index.ts`
3. Create component in `src/components/nodes/`
4. Export from `src/components/nodes/index.ts`
5. Add to `nodeTypes` in `WorkflowCanvas.tsx`
6. Add to `getNodeHandles()` in `WorkflowCanvas.tsx`
7. Add minimap color in `WorkflowCanvas.tsx`
8. Update handle mappings in `WorkflowCanvas.tsx` (for video/audio handles)
9. Add to `ConnectionDropMenu.tsx` (source/target options)
10. Add to `FloatingActionBar.tsx` (Tools menu)
11. Add `createDefaultNodeData` case in `workflowStore.ts`
12. Add to `defaultDimensions` in `workflowStore.ts`
13. Update `validation.ts` (VALID_NODE_TYPES, DEFAULT_DIMENSIONS, createDefaultNodeData)
14. Create API route if needed in `src/app/api/`

## User's Workflow Vision
- Create AI-generated videos with green screen subjects
- Composite multiple layers together
- Add intros/outros programmatically
- Mix audio tracks
- Full post-production pipeline in a visual editor
