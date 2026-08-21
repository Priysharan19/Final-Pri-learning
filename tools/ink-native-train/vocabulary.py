"""Canonical tokenization for the stroke-native recognizer.

The runtime grammar serializes multi-character mathematical names such as
`theta`, `sqrt`, `sin` and comparison operators.  Treating those as atomic
symbols gives CTC a much cleaner alignment target than spelling them as prose.
"""
from __future__ import annotations

SPECIAL_TOKENS = ("<blank>", "<unk>")
NAMED_TOKENS = (
    "theta", "sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "ln", "pi",
    "<=", ">=", "!=", "±",
)
SINGLE_TOKENS = tuple(
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=^().,[]<>!'°%:|?"
)
TOKENS = SPECIAL_TOKENS + NAMED_TOKENS + SINGLE_TOKENS
TOKEN_TO_ID = {token: index for index, token in enumerate(TOKENS)}
ID_TO_TOKEN = {index: token for token, index in TOKEN_TO_ID.items()}
BLANK_ID = TOKEN_TO_ID["<blank>"]
UNK_ID = TOKEN_TO_ID["<unk>"]


def canonicalize(raw: str) -> str:
    return (
        str(raw)
        .replace("×", "*")
        .replace("✕", "*")
        .replace("·", "*")
        .replace("∙", "*")
        .replace("÷", "/")
        .replace("−", "-")
        .replace("–", "-")
        .replace("—", "-")
        .replace("π", "pi")
        .replace("θ", "theta")
        .replace("√", "sqrt")
        .replace("≤", "<=")
        .replace("≥", ">=")
        .replace("≠", "!=")
        .replace(" ", "")
    )


def tokenize(raw: str) -> list[str]:
    text = canonicalize(raw)
    named = sorted(NAMED_TOKENS, key=len, reverse=True)
    out: list[str] = []
    index = 0
    while index < len(text):
        token = next((candidate for candidate in named if text.startswith(candidate, index)), None)
        if token is not None:
            out.append(token)
            index += len(token)
        else:
            out.append(text[index])
            index += 1
    return out


def encode(raw: str) -> list[int]:
    return [TOKEN_TO_ID.get(token, UNK_ID) for token in tokenize(raw)]


def decode(ids: list[int]) -> str:
    return "".join(ID_TO_TOKEN.get(int(index), "?") for index in ids if int(index) not in (BLANK_ID, UNK_ID))


def ctc_collapse(ids: list[int]) -> list[int]:
    out: list[int] = []
    previous = None
    for raw in ids:
        index = int(raw)
        if index != BLANK_ID and index != previous:
            out.append(index)
        previous = index
    return out
