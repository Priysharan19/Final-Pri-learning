// Student-owned Photo → Practice request epoch. A slow previous photograph
// must never replace the chapter/skill proposed for a newer photograph or
// update a page that was unmounted during provider recognition.
export function createPhotoRequestGate(makeController = () => new AbortController()) {
  let generation = 0, controller = null, mounted = true;
  return {
    next() {
      controller?.abort();
      controller = makeController();
      const epoch = ++generation;
      return { epoch, signal: controller.signal };
    },
    current(epoch) { return mounted && epoch === generation && !controller?.signal?.aborted; },
    dispose() { mounted = false; ++generation; controller?.abort(); controller = null; }
  };
}
