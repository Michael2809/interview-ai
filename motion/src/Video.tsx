import React from "react";
import { Series } from "remotion";
import {
  INTRO_DURATION,
  WORKLOAD_DURATION,
  PRESSURE_DURATION,
  MOUNTAIN_DURATION,
  SCREENING_DURATION,
  ELEVATOR_DURATION,
} from "./constants";
import { IntroScene } from "./scenes/IntroScene";
import { CandidateWorkloadScene } from "./scenes/CandidateWorkloadScene";
import { PressureShadowScene } from "./scenes/PressureShadowScene";
import { MountainRevealScene } from "./scenes/MountainRevealScene";
import { ScreeningLoopScene } from "./scenes/ScreeningLoopScene";
import { ElevatorRevealScene } from "./scenes/ElevatorRevealScene";

// The 20-second test sequence, assembled from six scenes in centralized
// order. Each scene owns its own camera and timing internally — see
// constants.ts for the frame budget of each beat.
export const RecrewtMotionTest: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={INTRO_DURATION} name="Intro">
        <IntroScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={WORKLOAD_DURATION} name="CandidateWorkload">
        <CandidateWorkloadScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={PRESSURE_DURATION} name="PressureShadow">
        <PressureShadowScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={MOUNTAIN_DURATION} name="MountainReveal">
        <MountainRevealScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCREENING_DURATION} name="ScreeningLoop">
        <ScreeningLoopScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={ELEVATOR_DURATION} name="ElevatorReveal">
        <ElevatorRevealScene />
      </Series.Sequence>
    </Series>
  );
};
