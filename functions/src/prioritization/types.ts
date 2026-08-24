export interface PriorityWeights {
  w1: number;
  w2: number;
  w3: number;
}

export interface PriorityInputs {
  volume: number;
  verificationStatus: "verified" | "needs_review" | "invalid";
  infraGapSeverity: number;
  category: string;
  country: string;
}
