import {getRepositories} from 'app/actionCreators/repositories';
import RepositoryActions from 'app/actions/repositoryActions';
import RepositoryStore from 'app/stores/repositoryStore';

describe('RepositoryActionCreator', function() {
  const orgSlug = 'myOrg';
  const repoUrl = `/organizations/${orgSlug}/repos/`;

  const api = new MockApiClient();
  const mockData = {id: '1'};
  let mockResponse;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockResponse = MockApiClient.addMockResponse({
      url: repoUrl,
      body: mockData,
    });

    RepositoryStore.init();
    jest.spyOn(RepositoryActions, 'loadRepositories');
    jest.spyOn(RepositoryActions, 'loadRepositoriesSuccess');
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.restoreAllMocks();
  });

  it('fetch a Repository and emit an action', async () => {
    getRepositories(api, {orgSlug});
    await tick();

    expect(mockResponse).toHaveBeenCalledWith(repoUrl, expect.anything());
    expect(RepositoryActions.loadRepositories).toHaveBeenCalledWith(orgSlug);
    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalledWith(
      orgSlug,
      mockData
    );
  });

  it('short-circuits the JS event loop', async () => {
    expect(RepositoryStore.state.repositoriesLoading).toEqual(undefined);

    getRepositories(api, {orgSlug});
    expect(RepositoryStore.state.repositoriesLoading).toEqual(true);
    expect(RepositoryActions.loadRepositories).toHaveBeenCalled();

    await tick();
    expect(RepositoryStore.state.repositoriesLoading).toEqual(false);
    expect(RepositoryActions.loadRepositoriesSuccess).toHaveBeenCalled();
  });
});
