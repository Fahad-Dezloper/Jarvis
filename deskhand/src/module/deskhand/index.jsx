import ActionLog from "./ActionLog";
import FirstVisitHint from "./FirstVisitHint";
import Missions from "./Missions";
import Subtitle from "./Subtitle";
import TypeInstead from "./TypeInstead";
import VirtualCursor from "./VirtualCursor";
import VoiceCapture from "./VoiceCapture";

// Mount point for the voice front door. Rendered once by the desktop.
// There is no visible input: VoiceCapture is an invisible focused field, Subtitle shows
// what was heard and what Orry answered.
export default function Orry() {
  return (
    <>
      <VoiceCapture />
      <div className="dk-stack">
        <Subtitle />
        <ActionLog />
        <FirstVisitHint />
      </div>
      <Missions />
      <TypeInstead />
      <VirtualCursor />
    </>
  );
}
