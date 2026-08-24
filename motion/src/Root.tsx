import "./index.css";
import { Composition, Folder } from "remotion";
import { RecrewtMotionTest } from "./Video";
import { IntroScene } from "./scenes/IntroScene";
import { CandidateWorkloadScene } from "./scenes/CandidateWorkloadScene";
import { PressureShadowScene } from "./scenes/PressureShadowScene";
import { MountainRevealScene } from "./scenes/MountainRevealScene";
import { ScreeningLoopScene } from "./scenes/ScreeningLoopScene";
import { ElevatorRevealScene } from "./scenes/ElevatorRevealScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RecrewtTest20s"
        component={RecrewtMotionTest}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Individual scenes, registered separately so each can be scrubbed,
          trimmed and previewed on its own in Remotion Studio. */}
      <Folder name="Scenes">
        <Composition
          id="Scene-1-Intro"
          component={IntroScene}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene-2-CandidateWorkload"
          component={CandidateWorkloadScene}
          durationInFrames={120}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene-3-PressureShadow"
          component={PressureShadowScene}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene-4-MountainReveal"
          component={MountainRevealScene}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene-5-ScreeningLoop"
          component={ScreeningLoopScene}
          durationInFrames={120}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Scene-6-ElevatorReveal"
          component={ElevatorRevealScene}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
