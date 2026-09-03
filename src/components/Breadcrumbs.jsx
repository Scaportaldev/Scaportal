import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import useBreadcrumbs from "@/hooks/useBreadcrumbs";

/** Breadcrumbs — pola dari dashboard starter (components/breadcrumbs.tsx). */
export default function Breadcrumbs() {
  const items = useBreadcrumbs();
  if (items.length === 0) return null;

  return (
    <Breadcrumb data-testid="breadcrumbs">
      <BreadcrumbList>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={item.link}>
              {!last && (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <Link
                      to={item.link}
                      className="transition-colors duration-200 hover:text-foreground"
                    >
                      {item.title}
                    </Link>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </BreadcrumbSeparator>
                </>
              )}
              {last && (
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold">{item.title}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
