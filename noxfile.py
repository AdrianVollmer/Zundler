import nox

@nox.session()
def tests(session):
    session.install(".[tests]")
    session.run("pytest", '--driver=firefox', *session.posargs)
