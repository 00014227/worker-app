import { WordPart } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Пункт с пословной разметкой. Ради этого юрист и открывает сравнение: видно
 * каждое вставленное и вычеркнутое слово, включая переставленное «не», которое
 * меняет смысл пункта на обратный.
 *
 * `side` говорит, какую половину показываем: в левой колонке вставленное не
 * нужно (его там ещё нет), в правой — не нужно вычеркнутое.
 */
export default function ClauseText({
  parts,
  text,
  side,
  className,
}: {
  parts: WordPart[] | null;
  text: string | null;
  side: "left" | "right";
  className?: string;
}) {
  if (!parts?.length) {
    return <span className={className}>{text ?? "—"}</span>;
  }

  const skip = side === "left" ? "added" : "removed";
  return (
    <span className={className}>
      {parts
        .filter((p) => p.kind !== skip)
        .map((p, i) => (
          <span
            key={i}
            className={cn(
              p.kind === "added" && "bg-green-100 text-green-900 rounded-[2px]",
              p.kind === "removed" && "bg-red-100 text-red-900 line-through rounded-[2px]",
            )}
          >
            {p.text}
          </span>
        ))}
    </span>
  );
}
