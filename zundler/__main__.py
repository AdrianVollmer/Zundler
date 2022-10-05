def main():
    from .args import parse_args
    args = parse_args()

    from .embed import embed_assets
    embed_assets(
        args.input_path,
        output_path=args.output_path,
    )


if __name__ == "__main__":
    main()
