import { cn } from "@/lib/utils"

export const INPUT_CLASSES = cn(
  "!h-10",
  "!w-full",
  "!rounded-md",
  "!border !border-gray-200 dark:!border-border",
  "!bg-gray-50 dark:!bg-muted/40",
  "!px-3",
  "!text-sm",
  "!text-gray-900 dark:!text-foreground",
  "!text-center",
  "placeholder:!text-gray-400 dark:placeholder:!text-muted-foreground",
  "placeholder:!text-center",
  "focus:!outline-none",
  "focus:!border-orange-500",
  "focus:!ring-1",
  "focus:!ring-orange-500",
  "disabled:!bg-gray-100 dark:disabled:!bg-muted/60",
  "disabled:!text-gray-400 dark:disabled:!text-muted-foreground",
  "disabled:!cursor-not-allowed",
  "transition-colors",
)

export const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-muted-foreground text-center'
