const decompress = async (url) => {
  const ds = new DecompressionStream('deflate');
  const response = await fetch(url);
  const blob_in = await response.blob();
  const stream_in = blob_in.stream().pipeThrough(ds);
  const result = await new Response(stream_in);
  return await result;
};

decompress(
  'data:application/octet-stream;base64,' + window.globalContext
).then((response) => response.json()
).then((result) => {
    console.log(result)
    window.globalContext = result;
    const script_common = document.createElement("script");
    script_common.textContent = window.globalContext.utils.zundler_common;
    document.body.append(script_common);

    const script_main = document.createElement("script");
    script_main.textContent = window.globalContext.utils.zundler_main;
    document.body.append(script_main);
});

