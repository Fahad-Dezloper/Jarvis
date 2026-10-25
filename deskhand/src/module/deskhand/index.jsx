import ActionLog from "./ActionLog";
import CommandBar from "./CommandBar";
import FirstVisitHint from "./FirstVisitHint";
import Missions from "./Missions";
import VirtualCursor from "./VirtualCursor";

// Mount point for the voice front door. Rendered once by the desktop.
export default function Orry() {
  return (
    <>
      <div className="dk-stack">
        <CommandBar />
        <ActionLog />
        <FirstVisitHint />
      </div>
      <Missions />
      <VirtualCursor />
    </>
  );
}
