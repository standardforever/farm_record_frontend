"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import type { InvoiceDetail } from "./api";

/** A4 document shell for invoices and receipts: seller block, title, body, footer; prints on white. */
export function PrintDoc({ seller, title, number, meta, children, footer }: {
  seller: InvoiceDetail["seller"]; title: string; number: string; meta: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[800px]">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3">To send it as a PDF, choose “Save as PDF” in the print window.</p>
        <Button variant="primary" onClick={() => window.print()}><Printer size={16} /> Print or save PDF</Button>
      </div>
      <article className="print-doc rounded-2xl border border-line bg-white p-8 text-[13px] text-[#16181a] shadow-[var(--shadow)] sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[#e3e1da] pb-5">
          <div>
            <div className="text-[20px] font-bold">{seller.name}</div>
            <div className="text-[#5b5f62]">{[seller.lga, seller.state].filter(Boolean).join(", ")}</div>
            {seller.phone && <div className="text-[#5b5f62]">{seller.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold uppercase tracking-wide">{title}</div>
            <div className="font-mono text-[14px]">{number}</div>
            <div className="mt-1 text-[#5b5f62]">{meta}</div>
          </div>
        </header>
        <div className="py-5">{children}</div>
        <footer className="border-t border-[#e3e1da] pt-4 text-[12px] text-[#5b5f62]">
          {footer}
          {seller.footer && <p className="mt-2">{seller.footer}</p>}
          <p className="mt-2">Made with Oko</p>
        </footer>
      </article>
    </div>
  );
}
