import type { ComponentType } from "react";

export type PanelGroupId = "basic" | "advanced";

export type PanelDefinition<Context> = {
  id: string;
  order: number;
  title: string;
  groupId: PanelGroupId;
  Component: ComponentType<Context>;
};
