import { Composer } from "@/components/shell/Composer";
import { MessageList } from "@/components/shell/MessageList";
import { TopBar } from "@/components/shell/TopBar";

export const metadata = { title: "گفت‌وگوی عمومی" };

export default function AppPage() {
  return (
    <>
      <TopBar />
      <MessageList />
      <Composer />
    </>
  );
}
