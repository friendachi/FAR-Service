import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { cx } from "./ui";

export function SignOutButton({ className, label = "ออกจากระบบ", iconOnly = false }: { className?: string; label?: string; iconOnly?: boolean }) {
  return (
    <form action={signOut}>
      <button type="submit" aria-label={label} className={cx("inline-flex items-center gap-2 font-semibold", className)}>
        <LogOut className="size-4" aria-hidden />
        {!iconOnly && label}
      </button>
    </form>
  );
}
