"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function PreviewMenu() {
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="w-full justify-start gap-2"><Eye className="size-4" />Preview as</Button></DropdownMenuTrigger><DropdownMenuContent align="start" className="w-56"><DropdownMenuLabel>Switch preview</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href="/agency/preview?role=client">Client portal</Link></DropdownMenuItem><DropdownMenuItem asChild><Link href="/agency/preview?role=account_manager">Account manager</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
