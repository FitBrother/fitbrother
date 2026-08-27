import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
import { CalculatingBlock } from "@/components/onboarding/blocks/CalculatingBlock";
import { ConsentBlock } from "@/components/onboarding/blocks/ConsentBlock";
import { FirstMealBlock } from "@/components/onboarding/blocks/FirstMealBlock";
import { GoalBlock } from "@/components/onboarding/blocks/GoalBlock";
import { HealthBlock } from "@/components/onboarding/blocks/HealthBlock";
import { HeightBlock } from "@/components/onboarding/blocks/HeightBlock";
import { IdentityBlock } from "@/components/onboarding/blocks/IdentityBlock";
import { NameBlock } from "@/components/onboarding/blocks/NameBlock";
import { PaywallBlock } from "@/components/onboarding/blocks/PaywallBlock";
import { PermissionsBlock } from "@/components/onboarding/blocks/PermissionsBlock";
import { RevealBlock } from "@/components/onboarding/blocks/RevealBlock";
import { SignupBlock } from "@/components/onboarding/blocks/SignupBlock";
import { SubmittingBlock } from "@/components/onboarding/blocks/SubmittingBlock";
import { WeightBlock } from "@/components/onboarding/blocks/WeightBlock";
import type { OnboardingBlockDef } from "@/lib/onboarding/types";

export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  // Fase A — anamnese, sessão anônima, painel de capítulos visível
  { id: "name", Component: NameBlock, chapter: 1 },
  { id: "basics", Component: BasicsBlock, chapter: 1 },
  { id: "height", Component: HeightBlock, chapter: 1 },
  { id: "weight", Component: WeightBlock, chapter: 1 },
  { id: "activity", Component: ActivityBlock, chapter: 1 },
  { id: "goal", Component: GoalBlock, chapter: 2 },
  { id: "health", Component: HealthBlock, chapter: 2, skippable: true },
  { id: "calculating", Component: CalculatingBlock, chapter: 3 },
  { id: "reveal", Component: RevealBlock, chapter: 3 },
  // Fase B — conta e legal, sem painel de capítulos
  { id: "signup", Component: SignupBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "submitting", Component: SubmittingBlock },
  // Fase C — ativação, conta já existe
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

// Índice de "submitting" no array acima (12) — é também a contagem de blocos
// "name".."consent" (0-11) que ainda autosalvam progresso ao avançar. O
// próprio "submitting" fica de fora: quando ele avança com sucesso, a conta
// já foi criada e complete_onboarding_impl já apagou a linha de
// onboarding_progress — salvar de novo aqui recriaria uma linha órfã que
// nunca mais seria lida (mesma armadilha que o M16 já evitava excluindo
// "calculating" do antigo DATA_BLOCK_COUNT).
export const DATA_BLOCK_COUNT = 12;
