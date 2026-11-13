import { useLocalSearchParams } from "expo-router";
import { ShareFlow } from "@/components/domain/share/ShareFlow";

export default function ShareScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  return <ShareFlow type={type ?? ""} id={id ?? ""} />;
}
