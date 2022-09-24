def main():
    from .args import parse_args
    args = parse_args()

    from .embed import embed_assets
    embed_assets(args.path)


if __name__ == "__main__":
    pass
