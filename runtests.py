import os
import sys
import fnmatch

from marionette_driver.marionette import Marionette

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

client = Marionette(host='localhost', port=2828)
client.start_session()

client.set_context(Marionette.CONTEXT_CHROME)

with open(os.path.join(BASE_DIR, 'jasmine.js')) as f:
    client.execute_script(f.read(), sandbox='tests', new_sandbox=False)

with open(os.path.join(BASE_DIR, 'boot.js')) as f:
    client.execute_script(f.read(), sandbox='tests', new_sandbox=False)

test_dir = sys.argv[1]
for root, dirnames, filenames in os.walk(test_dir):
    for filename in fnmatch.filter(filenames, 'test*.js'):
        with open(os.path.join(root, filename)) as f:
            client.execute_script(f.read(), sandbox='tests', new_sandbox=False)

specs = client.execute_script("""
runSpecs();
return jsApiReporter.specs();
""", sandbox='tests', new_sandbox=False)
print(specs)
