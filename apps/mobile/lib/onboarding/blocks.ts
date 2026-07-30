import { ActivityBlock } from "@/components/onboarding/blocks/ActivityBlock";
import { BarriersBlock } from "@/components/onboarding/blocks/BarriersBlock";
import { BasicsBlock } from "@/components/onboarding/blocks/BasicsBlock";
import { CalculatingBlock } from "@/components/onboarding/blocks/CalculatingBlock";
import { ConsentBlock } from "@/components/onboarding/blocks/ConsentBlock";
import { ContactBlock } from "@/components/onboarding/blocks/ContactBlock";
import { DietBlock } from "@/components/onboarding/blocks/DietBlock";
import { FirstMealBlock } from "@/components/onboarding/blocks/FirstMealBlock";
import { GoalBlock } from "@/components/onboarding/blocks/GoalBlock";
import { HabitsBlock } from "@/components/onboarding/blocks/HabitsBlock";
import { HealthBlock } from "@/components/onboarding/blocks/HealthBlock";
import { HeightBlock } from "@/components/onboarding/blocks/HeightBlock";
import { IdentityBlock } from "@/components/onboarding/blocks/IdentityBlock";
import { NameBlock } from "@/components/onboarding/blocks/NameBlock";
import { PaywallBlock } from "@/components/onboarding/blocks/PaywallBlock";
import { PermissionsBlock } from "@/components/onboarding/blocks/PermissionsBlock";
import { RevealBlock } from "@/components/onboarding/blocks/RevealBlock";
import { TrainingBlock } from "@/components/onboarding/blocks/TrainingBlock";
import { WeightBlock } from "@/components/onboarding/blocks/WeightBlock";
import type { OnboardingBlockDef } from "@/lib/onboarding/types";

export const ONBOARDING_BLOCKS: OnboardingBlockDef[] = [
  { id: "name", Component: NameBlock },
  { id: "basics", Component: BasicsBlock },
  { id: "height", Component: HeightBlock },
  { id: "weight", Component: WeightBlock },
  { id: "activity", Component: ActivityBlock },
  { id: "training", Component: TrainingBlock, skippable: true },
  { id: "habits", Component: HabitsBlock, skippable: true },
  { id: "goal", Component: GoalBlock },
  { id: "barriers", Component: BarriersBlock, skippable: true },
  { id: "diet", Component: DietBlock, skippable: true },
  { id: "health", Component: HealthBlock },
  { id: "permissions", Component: PermissionsBlock, skippable: true },
  { id: "contact", Component: ContactBlock },
  { id: "identity", Component: IdentityBlock },
  { id: "consent", Component: ConsentBlock },
  { id: "calculating", Component: CalculatingBlock },
  { id: "reveal", Component: RevealBlock },
  { id: "paywall", Component: PaywallBlock },
  { id: "first_meal", Component: FirstMealBlock },
];

export const DATA_BLOCK_COUNT = 15; // "name" .. "consent"
