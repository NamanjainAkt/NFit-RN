export type ChangeEventPayload = {
  value: string;
};

export type NfitWidgetModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
};
