# Session Notes - January 14, 2026

## What We Just Fixed
- Kie AI video integration was calling wrong API endpoint
- The `regenerateNode` function in workflowStore.ts was using old code that always hit `/api/video` (Google)
- Fixed it to check `nodeData.model?.startsWith("kieai-")` and route to `/api/video-kieai`

## Ready to Test
1. Select "Kie AI Veo 3.1 Fast" from video node dropdown
2. Make sure Kie AI API key is saved in Settings
3. Run video generation
4. Check console for: `[Video Regenerate] Model: kieai-veo3-fast | Using Kie AI: true`

## Future Ideas (Not Started)
- LTX-2 integration via fal.ai API (longer clips up to 20sec, audio sync, 4K)
- Would need to add fal.ai API key to settings

## Build Status
- Last build: PASSED
