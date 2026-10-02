// Pri Learning brand — the single slot every surface draws the brand through.
//
// <BrandMark/> renders the current mark (the italic P tile). When the new logo
// lands it replaces only this component; the header, auth panels and the
// account-action page all pick it up. The wordmark is real text, so it always
// reads the whole name; the mark beside it is decorative (aria-hidden).

export function BrandMark({ large = false }) {
  return <span className={`logo-bb${large ? ' logo-bb-lg' : ''}`} aria-hidden="true">P</span>;
}

export function Wordmark({ large = false, as: Tag = 'span', ...rest }) {
  return (
    <Tag className={`logo ${large ? 'logo-lg' : ''}`.trim()} {...rest}>
      <BrandMark large={large} />
      <span className="logo-name">Pri Learning</span>
    </Tag>
  );
}

export default BrandMark;
