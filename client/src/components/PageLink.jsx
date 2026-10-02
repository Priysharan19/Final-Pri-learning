import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pageLinkClick } from '../platform/pageLink.js';

/** A <Link> that pushes unless the browser is genuinely on `to` already.
 * See platform/pageLink.js for the stale-location race it closes. */
const PageLink = React.forwardRef(function PageLink({ to, onClick, target, replace, ...rest }, ref) {
  const navigate = useNavigate();
  return (
    <Link ref={ref} to={to} target={target} replace={replace} {...rest}
      onClick={pageLinkClick({ to, navigate, onClick, target, replace })} />
  );
});

export default PageLink;
