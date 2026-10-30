import { View } from "react-native";
import { PhotoAdjuster } from "@/components/domain/PhotoAdjuster";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";

import type { Enquadramento } from "@/lib/media/crop";

/**
 * O editor de enquadramento, no lugar do carrossel.
 *
 * **Substitui** o carrossel em vez de acontecer por cima dele: arrastar para
 * enquadrar e arrastar para trocar de preset são o mesmo gesto, e deixar os dois
 * ativos faria o pager roubar metade dos arrastos do editor.
 */
export function ShareAdjustStage({
  uri,
  value,
  onChange,
}: {
  uri: string;
  value: Enquadramento;
  onChange: (e: Enquadramento) => void;
}) {
  return (
    <View className="flex-1 justify-center px-4">
      <View style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}>
        <PhotoAdjuster
          uri={uri}
          aspect={SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT}
          value={value}
          onChange={onChange}
          radius={26}
        />
      </View>
    </View>
  );
}
