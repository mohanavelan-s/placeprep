import { useMemo } from "react";

import { useAuth } from "@/context/AuthContext";

const FREE_LIMITS = {
  plan_generations: 1,
  mentor_messages: 10,
} as const;

type TierFeature = keyof typeof FREE_LIMITS;

const FEATURE_FIELD: Record<TierFeature, "planGenerations" | "mentorMessages"> = {
  plan_generations: "planGenerations",
  mentor_messages: "mentorMessages",
};

export function useTierGate() {
  const { user } = useAuth();

  return useMemo(() => {
    const tier = user?.tier || "free";

    function canUse(feature: TierFeature) {
      if (!user) {
        return false;
      }

      if (tier !== "free") {
        return true;
      }

      return Number(user[FEATURE_FIELD[feature]] || 0) < FREE_LIMITS[feature];
    }

    function useFeature(feature: TierFeature) {
      return canUse(feature);
    }

    return {
      canUse,
      useFeature,
      tier,
      limits: FREE_LIMITS,
      usage: {
        plan_generations: Number(user?.planGenerations || 0),
        mentor_messages: Number(user?.mentorMessages || 0),
      },
    };
  }, [user]);
}
