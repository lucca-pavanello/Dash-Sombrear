import { cn } from "@/lib/utils"

export const INPUT_CLASSES = cn(
  "!h-10",
  "!w-full",
  "!rounded-md",
  "!border !border-gray-200",
  "!bg-gray-50",
  "!px-3",
  "!text-sm",
  "!text-gray-900",
  "!text-center",
  "placeholder:!text-gray-400",
  "placeholder:!text-center",
  "focus:!outline-none",
  "focus:!border-orange-500",
  "focus:!ring-1",
  "focus:!ring-orange-500",
  "disabled:!bg-gray-100",
  "disabled:!text-gray-400",
  "disabled:!cursor-not-allowed",
  "transition-colors",
)

export const LABEL_CLASS =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-muted-foreground text-center'
