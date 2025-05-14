import { plugin } from "bun";

plugin({
  name: "markdown-loader",
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, async (args) => {
      // read and parse the file
      const contents = await Bun.file(args.path).text();

      // and returns it as a module
      return {
        exports: { default: contents },
        loader: "object",
      };
    });
  },
});
