import { Circle, Path, Svg } from "react-native-svg";
import { colors } from "@/lib/colors";

interface BodyFatSilhouetteProps {
  sex: "male" | "female" | "other";
  bucket: 1 | 2 | 3 | 4 | 5;
  selected?: boolean;
  size?: number;
}

// Largura do tronco/cintura cresce por faixa — mesma silhueta base,
// interpolada entre um contorno mais estreito (faixa 1) e mais largo
// (faixa 5). Não é anatomia realista: é um indicador visual relativo
// entre as 5 opções, não uma medida exata.
const WAIST_WIDTH_BY_BUCKET: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 18,
  2: 22,
  3: 27,
  4: 33,
  5: 40,
};

export function BodyFatSilhouette({
  sex,
  bucket,
  selected = false,
  size = 56,
}: BodyFatSilhouetteProps) {
  const waist = WAIST_WIDTH_BY_BUCKET[bucket];
  const shoulderWidth = sex === "female" ? 30 : 36;
  const hipWidth = sex === "female" ? waist + 4 : waist;
  const fill = selected ? colors.primary[400] : colors.neutral[300];

  const cx = 50;
  const headR = 10;
  const headCy = 16;
  const shoulderY = 30;
  const waistY = 60;
  const hipY = 80;

  const bodyPath = [
    `M ${cx - shoulderWidth / 2} ${shoulderY}`,
    `L ${cx + shoulderWidth / 2} ${shoulderY}`,
    `L ${cx + waist / 2} ${waistY}`,
    `L ${cx + hipWidth / 2} ${hipY}`,
    `L ${cx - hipWidth / 2} ${hipY}`,
    `L ${cx - waist / 2} ${waistY}`,
    "Z",
  ].join(" ");

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={cx} cy={headCy} r={headR} fill={fill} />
      <Path d={bodyPath} fill={fill} />
    </Svg>
  );
}
