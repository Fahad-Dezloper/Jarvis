const folderIcon = "/system/icons/files/folder.webp";
const txtIcon = "/system/icons/files/txt.webp";

const txt = (id, name, description, position = "top-5 left-10", subtitle) => ({
  id,
  name,
  icon: txtIcon,
  kind: "file",
  fileType: "txt",
  position,
  ...(subtitle ? { subtitle } : {}),
  description,
});

export const README_FILE = txt(
  1,
  "Readme.txt",
  [
    "Hold Fn, speak, and your desktop obeys.",
    "Deskhand is a macOS-style desktop in your browser that you control with your voice. Dictate with Wispr Flow into the command bar (or just type), and Deskhand plans the actions and performs them on the desktop for you.",
    'Try saying: 1) "Open the terminal and run ls".  2) "Make a note called Groceries with milk, eggs and bread".  3) "Open Safari and search for northern lights".  4) "Play some music".  5) "Open Calculator and Settings side by side".',
  ],
  "top-5 left-10",
  "Hold Fn, speak, and your desktop obeys",
);

const WORK_LOCATION = {
  id: 1,
  type: "work",
  name: "Desktop",
  icon: "/system/icons/ui/work.svg",
  kind: "folder",
  children: [
    {
      id: 5,
      name: "Projects",
      icon: folderIcon,
      kind: "folder",
      position: "top-10 left-5",
      windowPosition: "top-[5vh] left-6",
      children: [
        txt(1, "Ideas.txt", [
          "A scratch list of things worth building someday.",
          "1. A habit tracker that nags politely.  2. A recipe box that scales ingredients.  3. A tiny dashboard for the weekly reading list.",
        ]),
        txt(2, "Todo.txt", [
          "Water the plants.",
          "Reply to the invitation.",
          "Book tickets for the weekend trip.",
        ]),
        txt(3, "Meeting Notes.txt", [
          "Weekly sync - agenda",
          "Review last week's goals, pick three priorities, assign owners, and schedule the next check-in.",
        ]),
      ],
    },
    {
      id: 6,
      name: "Demo Files",
      icon: folderIcon,
      kind: "folder",
      position: "top-52 left-5",
      windowPosition: "top-[20vh] left-6",
      children: [
        txt(1, "Shopping List.txt", ["Milk", "Eggs", "Bread", "Coffee beans", "Oranges"]),
        txt(2, "Quote.txt", [
          "The best way to predict the future is to invent it.",
          "Try asking Deskhand to open this file, or to make a new note with it.",
        ]),
      ],
    },
  ],
};

const ABOUT_LOCATION = {
  id: 2,
  type: "about",
  name: "Deskhand",
  icon: "/system/icons/ui/info.svg",
  kind: "folder",
  children: [
    README_FILE,
    txt(
      4,
      "about-deskhand.txt",
      [
        "Deskhand is a browser-based macOS-style desktop that you control by voice.",
        "Wispr Flow dictation types into the command bar, an engine plans the actions, and the desktop performs them. No sign-in and no setup needed.",
        "The desktop shell is forked from the MIT-licensed macos-portfolio project; see the README for credit.",
      ],
      "top-60 left-5",
      "A desktop that obeys your voice",
    ),
  ],
};

const TRASH_LOCATION = {
  id: 4,
  type: "trash",
  name: "Trash",
  icon: "/system/icons/dock/trash.svg",
  kind: "folder",
  children: [],
};

export const locations = {
  work: WORK_LOCATION,
  about: ABOUT_LOCATION,
  trash: TRASH_LOCATION,
};
