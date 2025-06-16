import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface SideSheetProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
}

export function SideSheet({ isOpen, onClose, title, description, children }: SideSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-1/3 overflow-y-auto p-8 bg-gray-50 [&>button]:hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
            {title}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  )
}
