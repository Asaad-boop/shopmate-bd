import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  const displayName = user?.user_metadata?.full_name || user?.email || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity">
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <User className="w-4 h-4 mr-2" />
          Profile & Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <KeyRound className="w-4 h-4 mr-2" />
          Change Password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
