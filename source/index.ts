#!/usr/bin/env node
import { Site, Parser, Generator, Filesystem } from "@enkelpanna/core"
import * as fs from "async-file"
import { resolve, extname as getExtension } from "path"

export class Program {
	readonly version = "0.1.0"
	constructor(private commands: (string | undefined)[]) {
		this.commands = this.commands.slice(2)
	}
	async run() {
		switch (this.commands.length > 0 && this.commands[0]) {
			default:
				{
					const input = await fs.realpath(__filename)
					const output = resolve(input, "public")
					const site = await Site.create(JSON.parse(await fs.readFile(resolve(input, "site.json"))), this.fetchParser, this.fetchGenerator)
					const root = await this.load(input, site.extensions)
					if (root instanceof Filesystem.Folder) {
						site.load(root)
						if (this.commands.length > 0)
							for (const name of this.commands) {
								const result = await site.generate(name)
								if (result)
									this.save(resolve(output, name), result)
							}
					} else {
						const result = await site.generate()
						if (result)
							this.save(output, result)
					}
				}
				break
			case "version":
				console.log("enkelpanna " + this.version)
				break
			case "help":
				console.log("help")
				break
		}
	}
	private async fetchParser(locator: string): Promise<Parser> {
		return Promise.reject("")
	}
	private async fetchGenerator(locator: string): Promise<Generator> {
		return Promise.reject("")
	}
	private async load(path: string, extensions: { [extension: string]: "ascii" | "base64" | "binary" | "hex" | "ucs2" | "utf16le" | "utf8" | undefined }): Promise<Filesystem.Node | undefined> {
		const status = await fs.stat(path)
		return status.isDirectory ? new Filesystem.Folder(async () => (await Promise.all((await fs.readdir(path)).map(node => ({ name: node, node: this.load(resolve(path, node), extensions)})))).reduce<{ [name: string]: Filesystem.Node }>((r, n) => { r[n.name] = n.node; return r }, {})) :
			status.isFile ? this.loadFile(path, extensions) :	undefined
	}
	private loadFile(path: string, extensions: { [extension: string]: "ascii" | "base64" | "binary" | "hex" | "ucs2" | "utf16le" | "utf8" | undefined }): Filesystem.File | undefined {
		let result: Filesystem.File | undefined
		const encoding = extensions[getExtension(path)]
		switch (encoding) {
			case "base64":
			case "binary":
			case "hex":
				result = new Filesystem.TextFile(() => fs.readFile(path, { encoding }))
			case "ascii":
			case "ucs2":
			case "utf16le":
			case "utf8":
				result = new Filesystem.BinaryFile(async () => Uint8Array.from(await fs.readFile(path, { encoding })))
				break
		}
		return result
	}
	private async save(path: string, node: Filesystem.Node): Promise<void> {
		if (await fs.exists(path))
			await fs.delete(path)
		if (node instanceof Filesystem.Folder) {
			await fs.createDirectory(path)
			const children = await node.children
			for (const name in children)
				if (children.hasOwnProperty(name))
					this.save(resolve(path, name), children[name])
		} else if (node instanceof Filesystem.TextFile)
			await fs.writeTextFile(path, await node.content, "utf8")
		else if (node instanceof Filesystem.BinaryFile)
			await fs.writeFile(path, Buffer.from((await node.content).buffer), "binary")
	}
}

const program = new Program(process.argv)
program.run().then(() => process.exit())
console.log("enkelpanna " + program.version)
