import ActionLog from "./ActionLog";
import FirstVisitHint from "./FirstVisitHint";
import Subtitle from "./Subtitle";
import TypeInstead from "./TypeInstead";
import VirtualCursor from "./VirtualCursor";
import VoiceCapture from "./VoiceCapture";

// Mount point for the voice front door. Rendered once by the desktop.
// There is no visible input: VoiceCapture is an invisible focused field, Subtitle shows
// what was heard and what Jarvis answered.
export default function Jarvis() {
  return (
    <>
      <VoiceCapture />
      <div className="dk-stack">
        <Subtitle />
        <ActionLog />
        <FirstVisitHint />
      </div>
      <TypeInstead />
      <VirtualCursor />
    </>
  );
}
