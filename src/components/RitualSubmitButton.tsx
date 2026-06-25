"use client";

import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  FilePenLine,
  Hourglass,
  ReceiptText,
  RotateCcw,
  Send,
  Stamp,
  UploadCloud,
  UserRound
} from "lucide-react";
import { Button, type ButtonSize, type ButtonType, type IconName } from "animal-island-ui";
import { IslandRitualPending } from "./IslandRitualPending";

type RitualSubmitIcon =
  | "check"
  | "file-pen"
  | "hourglass"
  | "receipt"
  | "rotate"
  | "send"
  | "stamp"
  | "upload"
  | "user";

type RitualSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  type?: ButtonType;
  size?: ButtonSize;
  block?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: RitualSubmitIcon;
  dataPendingScope?: string;
  ritual?: {
    title: string;
    description: string;
    iconName?: IconName;
    compact?: boolean;
  };
};

const iconMap = {
  check: CheckCircle2,
  "file-pen": FilePenLine,
  hourglass: Hourglass,
  receipt: ReceiptText,
  rotate: RotateCcw,
  send: Send,
  stamp: Stamp,
  upload: UploadCloud,
  user: UserRound
} satisfies Record<RitualSubmitIcon, typeof CheckCircle2>;

export function RitualSubmitButton({
  idleLabel,
  pendingLabel,
  type = "primary",
  size = "middle",
  block = false,
  danger = false,
  disabled = false,
  icon,
  dataPendingScope,
  ritual
}: RitualSubmitButtonProps) {
  const { pending } = useFormStatus();
  const IconComponent = icon ? iconMap[icon] : null;

  return (
    <div className="grid gap-3" data-ritual-submit-scope={dataPendingScope}>
      <Button
        block={block}
        danger={danger}
        disabled={disabled || pending}
        htmlType="submit"
        icon={IconComponent ? <IconComponent aria-hidden="true" size={18} /> : undefined}
        loading={pending}
        size={size}
        type={type}
      >
        {pending ? pendingLabel : idleLabel}
      </Button>
      {pending && ritual ? (
        <IslandRitualPending
          compact={ritual.compact}
          dataScope={dataPendingScope}
          description={ritual.description}
          iconName={ritual.iconName}
          title={ritual.title}
        />
      ) : null}
    </div>
  );
}
