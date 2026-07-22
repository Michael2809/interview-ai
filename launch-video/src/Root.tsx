import { Composition } from "remotion";
import { Scene1Hook } from "./scenes/Scene1Hook";
import { Scene2Dashboard } from "./scenes/Scene2Dashboard";
import { Scene3Interview } from "./scenes/Scene3Interview";
import { Scene4ScoreCard } from "./scenes/Scene4ScoreCard";
import { Scene5EndCard } from "./scenes/Scene5EndCard";
import { LaunchVideo } from "./scenes/LaunchVideo";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Scene-01-Hook"
        component={Scene1Hook}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="Scene-02-Dashboard"
        component={Scene2Dashboard}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="Scene-03-Interview"
        component={Scene3Interview}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="Scene-04-ScoreCard"
        component={Scene4ScoreCard}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="Scene-05-EndCard"
        component={Scene5EndCard}
        durationInFrames={180}
        fps={30}
        width={1920}
        height={1080}
      />

      <Composition
        id="LaunchVideo"
        component={LaunchVideo}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
