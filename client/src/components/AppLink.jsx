// An in-app link whose push/replace decision is made from the history entry
// the browser shows at click time, not from the router's last render (see
// linkReplacesEntry). Everything else is react-router's Link.
import React from 'react';
import { Link, useNavigate, useResolvedPath } from 'react-router-dom';
import { linkReplacesEntry } from '../platform/backNavigation.js';

const plainClick = (event, target) =>
  event.button === 0 && (!target || target === '_self') &&
  !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey);

export default function AppLink({ to, replace, state, target, onClick, ...rest }) {
  const navigate = useNavigate();
  const path = useResolvedPath(to);
  const handle = event => {
    onClick?.(event);
    if (event.defaultPrevented || !plainClick(event, target)) return;
    event.preventDefault();
    navigate(to, { replace: replace ?? linkReplacesEntry(path, window.location), state });
  };
  return <Link to={to} replace={replace} state={state} target={target} onClick={handle} {...rest} />;
}
