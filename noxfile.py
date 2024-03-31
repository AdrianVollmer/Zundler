import nox


@nox.session()
def tests(session):
    session.install(".[tests]")
    session.run("pytest", "--driver=firefox", *session.posargs)


@nox.session()
def black(session):
    session.install(".[tests]")
    session.run("black", "zundler", "--check", *session.posargs)
    session.run("black", "tests", "--check", *session.posargs)
