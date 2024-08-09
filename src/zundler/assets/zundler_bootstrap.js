async function decompressBase64Gzip(base64String) {
	// Convert the base64 string to a Uint8Array
	const binaryString = atob(base64String);
	const binaryLength = binaryString.length;
	const byteArray = new Uint8Array(binaryLength);

	for (let i = 0; i < binaryLength; i++) {
		byteArray[i] = binaryString.charCodeAt(i);
	}

	// Create a ReadableStream from the Uint8Array
	const inputStream = new ReadableStream({
		start(controller) {
			controller.enqueue(byteArray);
			controller.close();
		},
	});

	// Use DecompressionStream to decompress the gzipped data
	const decompressionStream = new DecompressionStream("deflate");
	const decompressedStream = inputStream.pipeThrough(decompressionStream);

	// Read the decompressed stream into an array buffer
	const reader = decompressedStream.getReader();
	const chunks = [];

	let result;
	while (!(result = await reader.read()).done) {
		chunks.push(result.value);
	}

	// Concatenate all chunks into a single Uint8Array
	const decompressedArray = new Uint8Array(
		chunks.reduce((acc, chunk) => acc + chunk.length, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		decompressedArray.set(chunk, offset);
		offset += chunk.length;
	}

	// Convert the Uint8Array to a string
	const decoder = new TextDecoder();
	const decompressedString = decoder.decode(decompressedArray);

	return decompressedString;
}

decompressBase64Gzip(window.globalContext).then((result) => {
	window.globalContext = JSON.parse(result);
	const script_common = document.createElement("script");
	script_common.textContent = window.globalContext.utils.zundler_common;
	document.body.append(script_common);

	const script_main = document.createElement("script");
	script_main.textContent = window.globalContext.utils.zundler_main;
	document.body.append(script_main);
});
