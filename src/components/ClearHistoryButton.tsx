import { Loader2, Trash2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ClearHistoryButtonProps = {
  title: string;
  description: string;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  pendingLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  buttonVariant?: ButtonProps["variant"];
  className?: string;
};

export default function ClearHistoryButton({
  title,
  description,
  onConfirm,
  pending = false,
  disabled = false,
  buttonLabel = "Clear history",
  pendingLabel = "Clearing...",
  confirmLabel = "Clear history",
  cancelLabel = "Cancel",
  buttonVariant = "outline",
  className,
}: ClearHistoryButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={buttonVariant}
          className={className}
          disabled={disabled || pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {pending ? pendingLabel : buttonLabel}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="border-border/80 bg-card text-foreground">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
