import { toParagraphs } from '@/lib/to-paragraphs';

export interface EditorialParagraphGroupProps {
  text: string;
  /** Applied to the outer stack (spacing between paragraphs). */
  wrapperClassName?: string;
  /** Applied to each `<p>` (typography + color). */
  paragraphClassName: string;
}

/**
 * Renders body text as a short stack of paragraphs; single newlines inside a paragraph become `<br />`.
 */
export default function EditorialParagraphGroup({
  text,
  wrapperClassName = 'space-y-2.5',
  paragraphClassName,
}: EditorialParagraphGroupProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = toParagraphs(trimmed);

  return (
    <div className={wrapperClassName}>
      {parts.map((paragraph, i) => (
        <p key={i} className={paragraphClassName}>
          {paragraph.split(/\n/).map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line.trim()}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}
